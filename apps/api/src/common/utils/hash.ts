import { compare, hash } from 'bcrypt';

export async function Hash(data: string): Promise<string> {
  return await hash(data, 10);
}

export async function Compare(
  data: string,
  hashedData: string,
): Promise<boolean> {
  return await compare(data, hashedData);
}
