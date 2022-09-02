import { Key, pathToRegexp, compile } from 'path-to-regexp';

const HTTP_URL_REGEX = /^http(s)?:\/\/(.*?)\//;

/**
 * Use path to match the incoming parameters, extract query and params
 * @param path Paths that may contain parameters, such as /fdp/:id/detail, path can not include `?`
 * @param params The incoming parameters may be query or params
 */
export const extractPathParams = (path: string, params?: Record<string, unknown>) => {
  const keys: Key[] = [];
  pathToRegexp(path.replace(HTTP_URL_REGEX, '/'), keys);
  const pathParams = {} as Record<string, unknown>;
  const bodyOrQuery = { ...params };
  if (keys.length > 0) {
    keys.forEach(({ name }) => {
      pathParams[name] = bodyOrQuery[name];
      delete bodyOrQuery[name];
    });
  }
  return {
    pathParams,
    bodyOrQuery,
  };
};

/**
 * Fill in the actual value for the path with parameters by path-to-regexp
 * @param path Paths that may contain parameters, such as /fdp/:id/detail, path can not include `?`
 * @param params The incoming parameters may be query or params
 * @returns
 */
export const generatePath = (path: string, params?: Record<string, unknown>) => {
  try {
    let urlPrefix = '';
    const regex = new RegExp(HTTP_URL_REGEX);
    const matchResult = regex.exec(path);
    if (matchResult) {
      [urlPrefix] = matchResult;
    }
    const toPathRepeated = compile(path.replace(HTTP_URL_REGEX, ''));
    return `${urlPrefix}${toPathRepeated(params)}`;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('path:', path, 'Error parsing url parameters');
    throw error;
  }
};
