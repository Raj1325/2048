import { mergeTypeDefs } from '@graphql-tools/merge';
import { authTypeDefs } from './auth.schema';

export const typeDefs = mergeTypeDefs([authTypeDefs]);
