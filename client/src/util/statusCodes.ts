/**
 * Status codes for the compiler.
 */
export enum StatusCode {
  /**
   * Request was successfully processed.
   */
  Success = 'success',

  /**
   * Request was invalid and could not be processed.
   */
  InvalidRequest = 'invalid_request',

  /**
   * The compiler has crashed.
   */
  CompilerError = 'compiler_error',
}
