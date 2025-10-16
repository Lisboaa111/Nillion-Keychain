import { Request, Response, NextFunction } from "express";

const DID_PREFIX = "did:nil:";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const validateRequired = (
  fields: Record<string, any>,
  required: string[]
): void => {
  const missing = required.filter((field) => !fields[field]);
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(", ")}`);
  }
};

export const parseDidToBytes = (didString: string): Uint8Array => {
  if (!didString.startsWith(DID_PREFIX)) {
    throw new ValidationError(`Invalid DID format: ${didString}`);
  }

  const publicKeyHex = didString.slice(DID_PREFIX.length);

  if (!/^[0-9a-fA-F]+$/.test(publicKeyHex)) {
    throw new ValidationError(`Invalid DID public key format: ${didString}`);
  }

  const publicKeyBytes = new Uint8Array(
    publicKeyHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  if (publicKeyBytes.length === 0) {
    throw new ValidationError(`Failed to parse DID: ${didString}`);
  }

  return publicKeyBytes;
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  console.error("Error:", err.message);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
};
