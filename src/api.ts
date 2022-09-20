import axios, { AxiosRequestConfig } from 'axios';
import qs from 'query-string';
import { generatePath, extractPathParams } from './utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FN = (...args: any[]) => any;

export interface APIConfig<T extends FN> extends AxiosRequestConfig {
  api: string;
  successMsg?: string;
  errorMsg?: string;
  mock?: T;
}

interface $options {
  isDownload?: boolean; // whether its download api
  isMultipart?: boolean; // upload formData attribute
  successMsg?: string; // eject message when success to override default message
  errorMsg?: string; // eject message when failed to override default message
  rawResponse?: boolean; // whether return raw http response
  axiosConfig?: AxiosRequestConfig;
}

type Merge<A, B> = { [K in keyof A]: K extends keyof B ? B[K] : A[K] } & B extends infer O
  ? { [K in keyof O]: O[K] }
  : never;

export interface CallParams {
  $options?: $options;
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
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (params?: CallParams & Merge<Parameters<T>[0], {}>) => {
    const { $options, ...rest } = params || {};
    // @ts-ignore ts-issue
    const { bodyOrQuery, pathParams } = extractPathParams(api, rest);
    const { isDownload, isMultipart, rawResponse, axiosConfig } = $options || {};
    let getParams = bodyOrQuery;
    let bodyData;
    if (['POST', 'PUT'].includes(upperMethod)) {
      if (Object.keys(bodyOrQuery).length) {
        if (isMultipart) {
          const formData = new FormData();
          Object.entries(bodyOrQuery).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((_v) => formData.append(`${key}[]`, _v));
            } else {
              formData.append(key, value as string | Blob);
            }
          });
          bodyData = formData;
        } else {
          bodyData = bodyOrQuery;
        }
      }
      getParams = {};
    }
    return axios({
      method,
      url: generatePath(api, pathParams),
      params: getParams,
      paramsSerializer: (p: Record<string, string>) => qs.stringify(p, { skipNull: true }),
      responseType: isDownload ? 'blob' : 'json',
      data: bodyData,
      ...axiosConfig,
    })
      .then((res) => {
        if (rawResponse) {
          return res;
        }
        const { onSuccess, dataPropertyName } = globalConfig;
        if (['POST', 'PUT'].includes(upperMethod)) {
          if (onSuccess && typeof onSuccess === 'function' && (successMsg ?? $options?.successMsg)) {
            onSuccess((successMsg ?? $options?.successMsg)!);
          }
          return res?.data;
        }
        return dataPropertyName ? res.data[dataPropertyName] : res.data;
      })
      .catch((err) => {
        const { onError } = globalConfig;
        console.error(`[Error occurred when calling API: ${generatePath(api, pathParams)}]`, err);
        if (onError) {
          onError(err, $options?.errorMsg);
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
