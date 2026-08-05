import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { access } from 'fs/promises';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { IUploadedAudioFile, ITranscriptionResult } from './interfaces';

const DEFAULT_MODEL = 'base';
const MAX_PROCESS_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_PROCESS_TIMEOUT_MS = 120_000;

interface ITranscriptionProcessOutput {
  text: string;
}

@Injectable()
export class FasterWhisperService {
  private readonly logger = new Logger(FasterWhisperService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Transcribes an upload using the local faster-whisper Python package.
   * The temporary file is removed whether processing succeeds or fails.
   */
  async transcribe(
    file: IUploadedAudioFile,
    language?: string,
  ): Promise<ITranscriptionResult> {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'beleqet-transcription-'));
    const extension = extname(file.originalname) || '.webm';
    const audioPath = join(temporaryDirectory, `upload${extension}`);

    try {
      await writeFile(audioPath, file.buffer);
      return await this.runProcess(audioPath, language);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }

  private async runProcess(audioPath: string, language?: string): Promise<ITranscriptionResult> {
    const pythonExecutable = this.configService.get<string>(
      'FASTER_WHISPER_PYTHON_PATH',
      'python3',
    );
    const model = this.configService.get<string>('FASTER_WHISPER_MODEL', DEFAULT_MODEL);
    const configuredTimeout = this.configService.get<number>(
      'FASTER_WHISPER_TIMEOUT_MS',
      DEFAULT_PROCESS_TIMEOUT_MS,
    );
    const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_PROCESS_TIMEOUT_MS;
    const projectRoot = process.cwd();
    const scriptPath = join(projectRoot, 'scripts', 'transcribe-with-faster-whisper.py');
    const fallbackScriptPath = join(__dirname, '..', '..', '..', 'scripts', 'transcribe-with-faster-whisper.py');
    const resolvedScriptPath = await this.resolveScriptPath(scriptPath, fallbackScriptPath);
    const processArguments = ['--file', audioPath, '--model', model];

    if (language) {
      processArguments.push('--language', language);
    }

    return new Promise<ITranscriptionResult>((resolve, reject) => {
      const child = spawn(pythonExecutable, [resolvedScriptPath, ...processArguments]);
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let outputSize = 0;
      let settled = false;
      const cleanup = (): void => {
        clearTimeout(timeout);
        child.stdout.off('data', onStdout);
        child.stderr.off('data', onStderr);
        child.off('error', onChildError);
        child.off('close', onClose);
      };
      const finish = (error?: BadGatewayException, result?: ITranscriptionResult): void => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else if (result) resolve(result);
      };
      const terminate = (): void => {
        if (!child.killed) child.kill('SIGKILL');
      };
      const failForOutputLimit = (): void => {
        terminate();
        finish(new BadGatewayException('Local transcription produced too much output'));
      };
      const timeout = setTimeout(() => {
        this.logger.error(`faster-whisper timed out after ${timeoutMs}ms`);
        terminate();
        finish(new BadGatewayException('Local transcription timed out'));
      }, timeoutMs);

      const onStdout = (chunk: Buffer): void => {
        if (settled) return;
        outputSize += chunk.length;
        if (outputSize > MAX_PROCESS_OUTPUT_BYTES) return failForOutputLimit();
        stdoutChunks.push(chunk);
      };
      const onStderr = (chunk: Buffer): void => {
        if (settled) return;
        outputSize += chunk.length;
        if (outputSize > MAX_PROCESS_OUTPUT_BYTES) return failForOutputLimit();
        stderrChunks.push(chunk);
      };
      const onChildError = (error: Error): void => {
        this.logger.error(`Unable to start faster-whisper: ${error.message}`, error.stack);
        finish(new BadGatewayException('Local speech-to-text service could not start'));
      };
      const onClose = (exitCode: number | null): void => {
        if (settled) return;
        if (exitCode !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
          this.logger.error(`faster-whisper failed (exit ${exitCode}): ${stderr}`);
          finish(
            new BadGatewayException(
              'Local transcription failed. Ensure the faster-whisper model is installed.',
            ),
          );
          return;
        }

        const output = Buffer.concat(stdoutChunks).toString('utf8');
        const parsed = this.parseProcessOutput(output);
        if (!parsed) {
          finish(new BadGatewayException('Local transcription returned an invalid response'));
          return;
        }

        finish(undefined, parsed);
      };

      child.stdout.on('data', onStdout);
      child.stderr.on('data', onStderr);
      child.on('error', onChildError);
      child.on('close', onClose);
    });
  }

  private async resolveScriptPath(primaryPath: string, fallbackPath: string): Promise<string> {
    const candidatePaths = [
      primaryPath,
      fallbackPath,
      join(process.cwd(), 'scripts', 'transcribe-with-faster-whisper.py'),
      join(__dirname, '..', '..', 'scripts', 'transcribe-with-faster-whisper.py'),
      join(__dirname, '..', 'scripts', 'transcribe-with-faster-whisper.py'),
    ];

    for (const candidatePath of candidatePaths) {
      try {
        await access(candidatePath);
        return candidatePath;
      } catch {
        // Continue trying the next candidate path.
      }
    }

    throw new BadGatewayException(
      'Local transcription script is missing. Ensure scripts/transcribe-with-faster-whisper.py is available.',
    );
  }

  private parseProcessOutput(output: string): ITranscriptionProcessOutput | undefined {
    try {
      const parsed: unknown = JSON.parse(output);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'text' in parsed &&
        typeof parsed.text === 'string'
      ) {
        return { text: parsed.text };
      }
    } catch {
      return undefined;
    }

    return undefined;
  }
}
