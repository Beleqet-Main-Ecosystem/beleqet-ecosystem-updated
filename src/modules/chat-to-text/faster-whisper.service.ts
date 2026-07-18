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

      child.stdout.on('data', (chunk: Buffer) => {
        outputSize += chunk.length;
        if (outputSize <= MAX_PROCESS_OUTPUT_BYTES) {
          stdoutChunks.push(chunk);
        }
      });
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
      child.on('error', (error: Error) => {
        this.logger.error(`Unable to start faster-whisper: ${error.message}`, error.stack);
        reject(new BadGatewayException('Local speech-to-text service could not start'));
      });
      child.on('close', (exitCode: number | null) => {
        if (outputSize > MAX_PROCESS_OUTPUT_BYTES || exitCode !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
          this.logger.error(`faster-whisper failed (exit ${exitCode}): ${stderr}`);
          reject(
            new BadGatewayException(
              'Local transcription failed. Ensure the faster-whisper model is installed.',
            ),
          );
          return;
        }

        const output = Buffer.concat(stdoutChunks).toString('utf8');
        const parsed = this.parseProcessOutput(output);
        if (!parsed) {
          reject(new BadGatewayException('Local transcription returned an invalid response'));
          return;
        }

        resolve(parsed);
      });
    });
  }

  private async resolveScriptPath(primaryPath: string, fallbackPath: string): Promise<string> {
    try {
      await access(primaryPath);
      return primaryPath;
    } catch {
      try {
        await access(fallbackPath);
        return fallbackPath;
      } catch {
        return primaryPath;
      }
    }
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
