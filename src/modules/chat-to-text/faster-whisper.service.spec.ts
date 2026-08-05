
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { FasterWhisperService } from './faster-whisper.service';
import { IUploadedAudioFile } from './interfaces';

const createMockFile = (overrides?: Partial<IUploadedAudioFile>): IUploadedAudioFile => ({
  buffer: Buffer.from('fake-audio-bytes'),
  mimetype: 'audio/webm',
  originalname: 'recording.webm',
  size: 17,
  ...overrides,
});

const mockSpawn = jest.fn();
const mockMkdtemp = jest.fn();
const mockWriteFile = jest.fn();
const mockRm = jest.fn();
const mockAccess = jest.fn();

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

jest.mock('fs/promises', () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  mkdtemp: (...args: unknown[]) => mockMkdtemp(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  rm: (...args: unknown[]) => mockRm(...args),
}));

function createMockProcess() {
  const { EventEmitter } = jest.requireActual<typeof import('events')>('events');
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as import('events').EventEmitter & {
    stdout: import('events').EventEmitter;
    stderr: import('events').EventEmitter;
    killed: boolean;
    kill: jest.Mock<boolean, [NodeJS.Signals]>;
  };
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.killed = false;
  proc.kill = jest.fn<boolean, [NodeJS.Signals]>(() => {
    proc.killed = true;
    return true;
  });
  return proc;
}

describe('FasterWhisperService', () => {
  let service: FasterWhisperService;

  const mockConfigService = {
    get: jest.fn((_key: string, fallback: string) => fallback),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FasterWhisperService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FasterWhisperService>(FasterWhisperService);
    jest.clearAllMocks();
    mockMkdtemp.mockResolvedValue('/tmp/beleqet-transcription-abc');
    mockWriteFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
  });

  it('should transcribe a file and return the result', async () => {
    const mockProc = createMockProcess();
    mockSpawn.mockReturnValue(mockProc);

    const promise = service.transcribe(createMockFile());

    process.nextTick(() => {
      mockProc.stdout.emit('data', Buffer.from(JSON.stringify({ text: 'Hello world' })));
      mockProc.emit('close', 0);
    });

    const result = await promise;

    expect(result).toEqual({ text: 'Hello world' });
    expect(mockRm).toHaveBeenCalledWith('/tmp/beleqet-transcription-abc', {
      force: true,
      recursive: true,
    });
  });

  it('should resolve the transcription script from the project root even if cwd changes', async () => {
    const originalCwd = process.cwd();
    process.chdir('/tmp');

    try {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      const promise = service.transcribe(createMockFile());

      process.nextTick(() => {
        mockProc.stdout.emit('data', Buffer.from(JSON.stringify({ text: 'Hello from /tmp' })));
        mockProc.emit('close', 0);
      });

      await promise;

      expect(mockSpawn).toHaveBeenCalled();
      const [, args] = mockSpawn.mock.calls[0];
      expect(args[0]).toContain('/scripts/transcribe-with-faster-whisper.py');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should reject with BadGatewayException when the process exits with a non-zero code', async () => {
    const mockProc = createMockProcess();
    mockSpawn.mockReturnValue(mockProc);

    const promise = service.transcribe(createMockFile());

    process.nextTick(() => {
      mockProc.stderr.emit('data', Buffer.from('model not found'));
      mockProc.emit('close', 1);
    });

    await expect(promise).rejects.toThrow(BadGatewayException);
  });

  it('should kill a process that exceeds the output limit', async () => {
    const mockProc = createMockProcess();
    mockSpawn.mockReturnValue(mockProc);
    const promise = service.transcribe(createMockFile());

    process.nextTick(() => {
      mockProc.stdout.emit('data', Buffer.alloc(1024 * 1024 + 1));
    });

    await expect(promise).rejects.toThrow(BadGatewayException);
    expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
  });
});
