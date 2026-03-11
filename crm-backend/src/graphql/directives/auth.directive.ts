import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { AppContext } from '../../context';
import { Errors } from '../../utils/errors';

const ROLES_HIERARCHY: Record<string, number> = {
  READ_ONLY: 0,
  MEMBER: 1,
  MANAGER: 2,
  TENANT_ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function authDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0];
      const requiresDirective = getDirective(schema, fieldConfig, 'requiresRole')?.[0];

      if (!authDirective && !requiresDirective) return fieldConfig;

      const { resolve = defaultFieldResolver } = fieldConfig;

      return {
        ...fieldConfig,
        resolve: async (source, args, context: AppContext, info) => {
          if (!context.currentUser) {
            throw Errors.unauthorized();
          }

          if (requiresDirective) {
            const requiredRole = requiresDirective['role'] as string;
            const userLevel = ROLES_HIERARCHY[context.currentUser.role] ?? -1;
            const requiredLevel = ROLES_HIERARCHY[requiredRole] ?? 99;

            if (userLevel < requiredLevel) {
              throw Errors.forbidden();
            }
          }

          return resolve(source, args, context, info);
        },
      };
    },
  });
}

export const authDirectiveTypeDefs = `
  directive @auth on FIELD_DEFINITION
  directive @requiresRole(role: UserRole!) on FIELD_DEFINITION
`;
