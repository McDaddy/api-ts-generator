import axios from 'axios';
import qs from 'query-string';
import { generatePath, extractPathParams } from './utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FN = (...args: any[]) => any;

export interface APIConfig<T extends FN> {
  api: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'get' | 'post' | 'put' | 'delete';
  successMsg?: string;
  errorMsg?: string;
  mock?: T;
}

interface $options {
  isDownload?: boolean; // whether its download api
  isMultipart?: string; // upload formData attribute
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
  onError?: (error: Error, message?: string) => void;
  dataPropertyName?: string;
}

let globalConfig: GlobalConfig = {};

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
    const { isDownload, isMultipart, rawResponse, onUploadProgress } = $options || {};
    let getParams = bodyOrQuery;
    // if ('pageNo' in bodyOrQuery && !('pageSize' in bodyOrQuery)) {
    //   bodyOrQuery.pageSize = DEFAULT_PAGESIZE;
    // }
    let bodyData;
    if (['POST', 'PUT'].includes(upperMethod)) {
      if (Object.keys(bodyOrQuery).length) {
        if (isMultipart) {
          const formData = new FormData();
          Object.entries(bodyOrQuery).forEach(([key, value]) => {
            formData.append(key, value as string | Blob);
          });
          bodyData = formData;
        } else {
          bodyData = bodyOrQuery;
        }
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
        return globalConfig.dataPropertyName ? res.data[globalConfig.dataPropertyName] : res.data;
      })
      .catch((err) => {
        console.error(`[Error occurred when calling API: ${generatePath(api, pathParams)}]`, err);
        if (globalConfig.onError) {
          globalConfig.onError(err, $options?.errorMsg);
        } else {
          throw err;
        }
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
