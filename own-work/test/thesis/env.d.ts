// The part of Express the listing uses. Request input is unknown, as def:fragment requires.
declare module 'express' {
  export interface Response { send: (body: string) => unknown }
}

declare const app: {
  get(path: string, handler: (req: { query: Record<string, unknown> }, res: import('express').Response) => void): void;
};
