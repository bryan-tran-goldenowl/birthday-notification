import { IsString, IsNotEmpty, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'John', description: 'User first name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'User last name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: '1990-01-15', description: 'User birthday (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  birthday: string;

  @ApiProperty({ example: 'America/New_York', description: 'User timezone (IANA format)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  timezone: string;
}
