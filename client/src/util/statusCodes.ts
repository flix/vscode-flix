/**
 * Status codes for the compiler.
 */
export enum StatusCode {
  /**
   * Request was successfully processed.
   */
  OK = 'OK',

  /**
   * Request was invalid and could not be processed.
   */
  INVALID_REQUEST = 'INVALID_REQUEST',

  /**
   * The compiler has crashed.
   */
  COMPILER_ERROR = 'COMPILER_ERROR',
}
