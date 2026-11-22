/**
 * An edit that cannot be done; its message is meant for the user.
 *
 * @author Roberto Metere
 * @license MIT
 */
class EditError extends Error {
  name: string;

  /**
   * Builds the error.
   *
   * @param {string} message What went wrong.
   */
  constructor(message: string) {
    super(message);
    this.name = "EditError";
  }
}
// ----------------------------------------------------------------
