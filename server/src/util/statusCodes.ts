/**
 * Status codes for the compiler.
 */
export enum StatusCode {
  /**
   * Request was successfully processed.
   */
  Ok = 'OK',

  /**
   * Request was invalid and could not be processed.
   */
  InvalidRequest = 'INVALID_REQUEST',

  /**
   * The compiler has crashed.
   */
  CompilerError = 'COMPILER_ERROR',
}
