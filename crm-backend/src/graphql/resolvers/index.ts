import { mergeResolvers } from '@graphql-tools/merge';
import { authResolvers } from './auth.resolver';

export const resolvers = mergeResolvers([authResolvers]);
