declare module 'class-validator' {
  export function IsString(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsOptional(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsBoolean(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsInt(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsNumber(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsEnum(entity: object, validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsArray(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsUUID(version?: string | number, validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsUrl(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsObject(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsEmail(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsNotEmpty(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsPositive(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsDateString(validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsUppercase(validationOptions?: Record<string, any>): PropertyDecorator;
  export function Min(min: number, validationOptions?: Record<string, any>): PropertyDecorator;
  export function Max(max: number, validationOptions?: Record<string, any>): PropertyDecorator;
  export function MinLength(min: number, validationOptions?: Record<string, any>): PropertyDecorator;
  export function MaxLength(max: number, validationOptions?: Record<string, any>): PropertyDecorator;
  export function Length(min: number, max?: number, validationOptions?: Record<string, any>): PropertyDecorator;
  export function IsIn(values: any[], validationOptions?: Record<string, any>): PropertyDecorator;
}
declare module 'class-transformer' {
  export function Type(typeFn: (type?: any) => any): PropertyDecorator;
}
