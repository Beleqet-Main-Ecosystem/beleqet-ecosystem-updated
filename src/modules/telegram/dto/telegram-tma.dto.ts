import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TmaAuthDto {
  @ApiProperty({
    description: 'Raw query string (initData) received from window.Telegram.WebApp.initData',
    example: 'query_id=AAHd...&user=%7B%22id%22%3A123456%7D&auth_date=1658428800&hash=3e8958c2...',
  })
  @IsString()
  @IsNotEmpty()
  initData: string;
}
