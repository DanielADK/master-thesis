// The app of the listing; Response comes from @types/express. Request input is unknown, as def:fragment requires.
declare const app: {
  get(path: string, handler: (req: { query: Record<string, unknown> }, res: import('express').Response) => void): void;
};
