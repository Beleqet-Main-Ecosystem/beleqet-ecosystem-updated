import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactMessageDto {
  @ApiProperty() @IsString() @Length(2, 100) name: string;
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
  @ApiProperty() @IsString() @Length(3, 150) subject: string;
  @ApiProperty() @IsString() @Length(10, 5000) message: string;
}
