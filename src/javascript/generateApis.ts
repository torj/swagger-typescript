import {
  getTsType,
  getDefineParam,
  getParamString,
  getSchemaName,
} from "./utils";
import { ApiAST, Config, TypeAST } from "../types";
import {
  SERVICE_BEGINNING,
  SERVICE_NEEDED_FUNCTIONS,
  DEPRECATED_WARM_MESSAGE,
} from "./strings";
import { getJsdoc } from "../utilities/jsdoc";
import { isAscending, isMatchWholeWord } from "../utils";

function generateApis(
  apis: ApiAST[],
  types: TypeAST[],
  config: Config,
): string {
  let code = SERVICE_BEGINNING;
  try {
    const apisCode = apis
      .sort(({ serviceName }, { serviceName: _serviceName }) =>
        isAscending(serviceName, _serviceName),
      )
      .reduce(
        (
          prev,
          {
            contentType,
            summary,
            deprecated,
            serviceName,
            queryParamsTypeName,
            pathParams,
            requestBody,
            headerParams,
            isQueryParamsNullable,
            isHeaderParamsNullable,
            responses,
            method,
            endPoint,
            pathParamsRefString,
            additionalAxiosConfig,
            security,
          },
        ) => {
          return (
            prev +
            `
${getJsdoc({
  description: summary,
  deprecated: deprecated ? DEPRECATED_WARM_MESSAGE : undefined,
})}export const ${serviceName} = (
    ${
      /** Path parameters */
      pathParams
        .map(({ name, required, schema, description }) =>
          getDefineParam(name, required, schema, config, description),
        )
        .join(",")
    }${pathParams.length > 0 ? "," : ""}${
              /** Request Body */
              requestBody
                ? `${getDefineParam("requestBody", true, requestBody, config)},`
                : ""
            }${
              /** Query parameters */
              queryParamsTypeName
                ? `${getParamString(
                    "queryParams",
                    !isQueryParamsNullable,
                    queryParamsTypeName,
                  )},`
                : ""
            }${
              /** Header parameters */
              headerParams
                ? `${getParamString(
                    "headerParams",
                    !isHeaderParamsNullable,
                    headerParams,
                  )},`
                : ""
            }configOverride?:AxiosRequestConfig
): Promise<SwaggerResponse<${
              responses ? getTsType(responses, config) : "any"
            }>> => {
  ${
    deprecated
      ? `
  if (__DEV__) {
    console.warn(
      "${serviceName}",
      "${DEPRECATED_WARM_MESSAGE}",
    );
  }`
      : ""
  }
  return Http.${method}Request(
    ${
      pathParamsRefString
        ? `template(${serviceName}.key,${pathParamsRefString})`
        : `${serviceName}.key`
    },
    ${queryParamsTypeName ? "queryParams" : "undefined"},
    ${
      requestBody
        ? contentType === "multipart/form-data" ||
          contentType === "application/x-www-form-urlencoded"
          ? "objToForm(requestBody)"
          : "requestBody"
        : "undefined"
    },
    ${security},
    overrideConfig(${additionalAxiosConfig},
      configOverride,
    )
  )
}

/** Key is end point string without base url */
${serviceName}.key = "${endPoint}";
`
          );
        },
        "",
      );

    code +=
      types.reduce((prev, { name: _name }) => {
        const name = getSchemaName(_name);

        if (!isMatchWholeWord(apisCode, name)) {
          return prev;
        }

        return prev + ` ${name},`;
      }, "import {") + '}  from "./types"\n';

    code += SERVICE_NEEDED_FUNCTIONS;
    code += apisCode;
    return code;
  } catch (error) {
    console.error(error);
    return "";
  }
}

export { generateApis };
