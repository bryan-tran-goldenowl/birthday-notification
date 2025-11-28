import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane', description: 'User first name' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Smith', description: 'User last name' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '1990-01-15', description: 'User birthday (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  birthday?: string;

  @ApiPropertyOptional({ example: 'Europe/London', description: 'User timezone (IANA format)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({ example: '2020-06-20', description: 'User anniversary date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  anniversaryDate?: string;
}
