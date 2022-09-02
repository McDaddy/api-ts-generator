import axios from 'axios';
import qs from 'query-string';
import { Key, pathToRegexp, compile } from 'path-to-regexp';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FN = (...args: any[]) => any;

const HTTP_URL_REGEX = /^http(s)?:\/\/(.*?)\//;

export interface APIConfig<T extends FN> {
  api: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'get' | 'post' | 'put' | 'delete';
  successMsg?: string;
  errorMsg?: string;
  globalKey?: string;
  mock?: T;
}

interface $options {
  isDownload?: boolean; // whether its download api
  uploadFileKey?: string; // upload formData attribute
  successMsg?: string; // eject message when success to override default message
  errorMsg?: string; // eject message when failed to override default message
  rawResponse?: boolean; // whether return raw http response
  onUploadProgress?: (progressEvent: ProgressEvent) => void;
}

type $body = Record<string, unknown>;

type Merge<A, B> = { [K in keyof A]: K extends keyof B ? B[K] : A[K] } & B extends infer O
  ? { [K in keyof O]: O[K] }
  : never;

export interface CallParams {
  $options?: $options;
  $body?: $body;
}

const VALID_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

interface GlobalConfig {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

let globalConfig: GlobalConfig = {};

/**
 * Fill in the actual value for the path with parameters by path-to-regexp
 * @param path Paths that may contain parameters, such as /fdp/:id/detail, path can not include `?`
 * @param params The incoming parameters may be query or params
 * @returns
 */
const generatePath = (path: string, params?: Record<string, unknown>) => {
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

/**
 * Use path to match the incoming parameters, extract query and params
 * @param path Paths that may contain parameters, such as /fdp/:id/detail, path can not include `?`
 * @param params The incoming parameters may be query or params
 */
const extractPathParams = (path: string, params?: Record<string, unknown>) => {
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

export const genRequest = function <T extends FN>(apiConfig: APIConfig<T>) {
  const { api, method = 'GET', successMsg } = apiConfig;
  const upperMethod = method.toUpperCase();
  if (!VALID_METHODS.includes(upperMethod)) {
    throw new Error(`Invalid method: ${method}`);
  }
  return (params?: CallParams & Merge<Parameters<T>[0], Record<string, unknown>>) => {
    const { $options, $body, ...rest } = params || {};
    // @ts-ignore ts-issue
    const { bodyOrQuery, pathParams } = extractPathParams(api, rest);
    const { isDownload, uploadFileKey, rawResponse, onUploadProgress } = $options || {};
    let getParams = bodyOrQuery;
    // if ('pageNo' in bodyOrQuery && !('pageSize' in bodyOrQuery)) {
    //   bodyOrQuery.pageSize = DEFAULT_PAGESIZE;
    // }
    let bodyData;
    if (['POST', 'PUT'].includes(upperMethod)) {
      if (Object.keys(bodyOrQuery).length) {
        bodyData = uploadFileKey ? bodyOrQuery[uploadFileKey] : bodyOrQuery;
      }
      getParams = {};
    } else if (upperMethod === 'DELETE') {
      bodyData = $body;
    }
    return axios({
      method,
      url: generatePath(api, pathParams),
      params: getParams,
      paramsSerializer: (p: Record<string, string>) => qs.stringify(p),
      responseType: isDownload ? 'blob' : 'json',
      data: bodyData,
      onUploadProgress,
    })
      .then((res) => {
        if (rawResponse) {
          return res;
        }
        if (['POST', 'PUT'].includes(upperMethod)) {
          if (
            globalConfig.onSuccess &&
            typeof globalConfig.onSuccess === 'function' &&
            (successMsg ?? $options?.successMsg)
          ) {
            globalConfig.onSuccess((successMsg ?? $options?.successMsg)!);
          }
          return res?.data;
        }
        return res?.data?.data;
      })
      .catch((err) => {
        console.error('api err: ', err);
        throw err;
      }) as unknown as Promise<ReturnType<T>>;
  };
};

export function apiCreator<T extends FN>(apiConfig: APIConfig<T>) {
  const apiFn = genRequest<T>(apiConfig);
  return apiFn;
}

export const initApiGenerator = (config: GlobalConfig) => {
  globalConfig = config;
};

export default apiCreator;
