import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_.-]+$/, {
    message: 'username may only contain letters, digits, ".", "_" and "-"',
  })
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export type LoginResponse = {
  access_token: string;
  userId: string;
};
