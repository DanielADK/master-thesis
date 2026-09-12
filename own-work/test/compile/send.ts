// send accepts the real response types of Express, Fastify and node:http (sec:lib-rozhrani, objective 3).
import type { Response } from 'express';
import type { FastifyReply } from 'fastify';
import type { ServerResponse } from 'node:http';
import { html, send } from '../../lib/index.ts';

declare const express: Response;
declare const fastify: FastifyReply;
declare const node: ServerResponse;
declare const raw: string;
const page = html('<p>x</p>');
send(express, page);
send(fastify, page);
send(node, page);
// @ts-expect-error TS2769: a plain string is neither a literal nor SafeHtml
send(express, raw);
