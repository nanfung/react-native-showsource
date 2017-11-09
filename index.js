'use strict';

import {Platform} from 'react-native';
import StackTrace from 'stacktrace-js';
import {Crashlytics, Answers} from 'react-native-fabric';
import RNFS from "react-native-fs";
import SourceMap from "source-map";

let sourceMapper = undefined;

export function init() {
  var originalHandler = ErrorUtils.getGlobalHandler();

  async function errorHandler(e, isFatal) {
    const options = {};
    try {
      const sourcemaplink = await RNFS.readFileAssets("index.android.bundle.map");
      console.log(await RNFS.readDirAssets(""));
      const option = {
        // sourceCache: sourcemaplink,
        offline: true
      };
      sourceMapper = await createSourceMapper(sourcemaplink);
      const minStackTrace = await StackTrace.fromError(e, option);
      const stackTrace = minStackTrace.map(row => {
        const mapped = sourceMapper(row);
        const source = mapped.source || "";
        const fileName = options.projectPath ? source.split(options.projectPath).pop() : source;
        const functionName = mapped.name || "unknown";
        return {
          fileName,
          functionName,
          lineNumber: mapped.line,
          columnNumber: mapped.column,
          position: `${functionName}@${fileName}:${mapped.line}:${mapped.column}`
        };
      });
      Crashlytics.recordCustomExceptionName(e.message, e.message, stackTrace);
    } catch (error) {
      console.log(error);
    } finally {
      if (originalHandler) {
        if (Platform.OS === 'ios') {
          originalHandler(e, isFatal);
        } else {
          setTimeout(() => {
            originalHandler(e, isFatal);
          }, 500);
        }
      }
    }
  }

  const createSourceMapper = async (mapContents) => {
    try {
      const sourceMaps = JSON.parse(mapContents);
      const mapConsumer = new SourceMap.SourceMapConsumer(sourceMaps);
      return sourceMapper = row => {
        return mapConsumer.originalPositionFor({
          line: row.lineNumber,
          column: row.columnNumber,
        });
      };
    }
    catch (error) {
      throw error;
    }
  }

  ErrorUtils.setGlobalHandler(errorHandler);
}