import { Key, pathToRegexp, compile } from 'path-to-regexp';

const HTTP_URL_REGEX = /^http(s)?:\/\/(.*?)\//;

/**
 * Use path to match the incoming parameters, extract query and params
 * @param path Paths that may contain parameters, such as /fdp/:id/detail
 * @param params The incoming parameters may be query or params
 */
export const extractPathParams = (path: string, params?: Record<string, unknown>) => {
  const keys: Key[] = [];
  const _path = path.replace(HTTP_URL_REGEX, '/');
  pathToRegexp(
    _path.indexOf('?') > 0 ? _path.substring(0, _path.indexOf('?')) : _path,
    keys
  ); // in case has ? in url
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
 * @param path Paths that may contain parameters, such as /fdp/:id/detail
 * @param params The incoming parameters may be query or params
 * @returns
 */
export const generatePath = (path: string, params?: Record<string, unknown>) => {
  try {
    let urlPrefix = '';
    let urlSuffix = '';
    const regex = new RegExp(HTTP_URL_REGEX);
    const matchResult = regex.exec(path);
    if (matchResult) {
      [urlPrefix] = matchResult;
    }
    const markIndex = path.indexOf('?');
    if (markIndex > 0) {
      urlSuffix = path.substring(markIndex);
    }

    const toPathRepeated = compile(path.replace(HTTP_URL_REGEX, '').replace(urlSuffix, ''));
    return `${urlPrefix}${toPathRepeated(params)}${urlSuffix}`;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('path:', path, 'Error parsing url parameters');
    throw error;
  }
};
