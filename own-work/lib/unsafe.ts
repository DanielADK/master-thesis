// Escapes from the type system (sec:lib-rozhrani): level mid, one context, identity at run time.
// Import only from the audited module; the lint rule of objective 4 enforces it.
import type { Ctx, Str } from '../src/index.ts';

const lift = <C extends Ctx>(s: string): Str<'lit' | 'val', C> => s as unknown as Str<'lit' | 'val', C>;
/** Markup the programmer vouches for, for example DOMPurify output. */
export const unsafeHtml = (s: string): Str<'lit' | 'val', 'html'> => lift(s);
/** Text the programmer vouches for. */
export const unsafeText = (s: string): Str<'lit' | 'val', 'text'> => lift(s);
/** A script string body the programmer vouches for. */
export const unsafeScript = (s: string): Str<'lit' | 'val', 'script'> => lift(s);
/** A URL the programmer vouches for. */
export const unsafeUrl = (s: string): Str<'lit' | 'val', 'url'> => lift(s);
/** A script address the programmer vouches for. */
export const unsafeResourceUrl = (s: string): Str<'lit' | 'val', 'res'> => lift(s);
