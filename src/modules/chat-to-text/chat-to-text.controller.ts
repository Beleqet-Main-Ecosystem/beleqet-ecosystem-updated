import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpCode,
  Logger,
  ParseFilePipeBuilder,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatToTextService } from './chat-to-text.service';
import {
  CreateConversationDto,
  CreateTranscriptDto,
  TranscribeAudioDto,
  UpdateTranscriptDto,
} from './dtos';
import { IUploadedAudioFile } from './interfaces';

const MAX_AUDIO_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/aac',
  'audio/flac',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'application/octet-stream',
  'application/x-wav',
  'binary/octet-stream',
];

const SUPPORTED_AUDIO_EXTENSIONS = new Set(['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.wav', '.webm', '.mp4']);

function isSupportedAudioOrVideoFile(file: IUploadedAudioFile): boolean {
  const mimetype = (file.mimetype || '').toLowerCase();
  if (ALLOWED_AUDIO_MIME_TYPES.includes(mimetype)) {
    return true;
  }

  if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) {
    return true;
  }

  const originalName = (file.originalname || '').toLowerCase();
  const extension = originalName.includes('.')
    ? originalName.slice(originalName.lastIndexOf('.'))
    : '';

  return SUPPORTED_AUDIO_EXTENSIONS.has(extension);
}

@ApiTags('chat-to-text')
@Controller('chat-to-text')
export class ChatToTextController {
  private readonly logger = new Logger(ChatToTextController.name);

  constructor(private readonly chatToTextService: ChatToTextService) {}

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a speech conversation record' })
  async createConversation(@Body() createConversationDto: CreateConversationDto) {
    const conversation = await this.chatToTextService.createConversation(createConversationDto);
    return {
      success: true,
      data: conversation,
      message: 'Conversation created successfully',
    };
  }

  @Post('transcribe')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Transcribe an uploaded audio or video file' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AUDIO_FILE_SIZE_BYTES } }))
  async transcribeAudio(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_AUDIO_FILE_SIZE_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: IUploadedAudioFile,
    @Body() transcribeAudioDto: TranscribeAudioDto,
  ) {
    if (!isSupportedAudioOrVideoFile(file)) {
      throw new BadRequestException('Unsupported audio or video file type');
    }

    const transcript = await this.chatToTextService.transcribeAudio(file, transcribeAudioDto);

    return {
      success: true,
      data: transcript,
      message: 'Audio transcribed successfully',
    };
  }

  @Post('stream')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Transcribe an incremental audio chunk while streaming' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AUDIO_FILE_SIZE_BYTES } }))
  async transcribeStreamChunk(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_AUDIO_FILE_SIZE_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: IUploadedAudioFile,
    @Body() transcribeAudioDto: TranscribeAudioDto,
  ) {
    if (!isSupportedAudioOrVideoFile(file)) {
      throw new BadRequestException('Unsupported audio or video file type');
    }

    const transcript = await this.chatToTextService.transcribeChunk(file, transcribeAudioDto);

    return {
      success: true,
      data: transcript,
      message: 'Stream chunk transcribed successfully',
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a transcript from raw text' })
  async create(@Body() createTranscriptDto: CreateTranscriptDto) {
    this.logger.log(
      `Creating transcript for conversation: ${createTranscriptDto.conversationId}`,
    );
    const transcript = await this.chatToTextService.create(createTranscriptDto);
    return {
      success: true,
      data: transcript,
      message: 'Transcript created successfully',
    };
  }

  @Get('conversation/:conversationId')
  @ApiOperation({ summary: 'List transcripts for a conversation' })
  async findByConversation(@Param('conversationId') conversationId: string) {
    const transcripts = await this.chatToTextService.findByConversation(conversationId);
    return {
      success: true,
      data: transcripts,
      count: transcripts.length,
    };
  }

  @Get('history/:conversationId')
  @ApiOperation({ summary: 'Get full conversation history' })
  async getHistory(@Param('conversationId') conversationId: string) {
    const history = await this.chatToTextService.getConversationHistory(conversationId);
    return {
      success: true,
      data: history,
    };
  }

  @Get('stats/:conversationId')
  @ApiOperation({ summary: 'Get conversation transcription statistics' })
  async getStatistics(@Param('conversationId') conversationId: string) {
    const statistics = await this.chatToTextService.getStatistics(conversationId);
    return {
      success: true,
      data: statistics,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transcript by ID' })
  async findById(@Param('id') id: string) {
    const transcript = await this.chatToTextService.findById(id);
    return {
      success: true,
      data: transcript,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transcript' })
  async update(@Param('id') id: string, @Body() updateTranscriptDto: UpdateTranscriptDto) {
    const transcript = await this.chatToTextService.update(id, updateTranscriptDto);
    return {
      success: true,
      data: transcript,
      message: 'Transcript updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a transcript' })
  async delete(@Param('id') id: string) {
    await this.chatToTextService.delete(id);
    return {
      success: true,
      message: 'Transcript deleted successfully',
    };
  }
}
