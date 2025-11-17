import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactEventHandler,
} from "react";
import { StyleSheet } from "react-native";
import WebView, { type WebViewProps } from "react-native-webview";
import type { WebViewSourceHtml } from "react-native-webview/lib/WebViewTypes";
import { replaceLast } from "./utils";

export interface WebWebviewProps extends WebViewProps {
  title?: string;
}

// This js adds a postMessage function to the webview
const DEFAULT_INJECT_JS = `window.ReactNativeWebView = { postMessage: (...args) => window.parent.postMessage(args[0])}`;

const NAVIGATION_INTERCEPTION_JS = `
document.addEventListener('click', function(e) {
  var anchor = e.target.closest('a');
  if (anchor && anchor.href) {
    e.preventDefault();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'navigationStateChange', url: anchor.href, navigationType: 'click' }));
  }
}, true);
`;

export const WebWebView = forwardRef<WebView, WebWebviewProps>((props, ref) => {
  const { title, source, onLoad, scrollEnabled, style } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const styleObj = StyleSheet.flatten(style);

  // Get iframe source
  const _source = useMemo(() => {
    // TODO: support other source types
    if (!source) return undefined;
    // TODO: support base url
    if ((source as WebViewSourceHtml).html) {
      const pageHtml = (source as WebViewSourceHtml).html;
      // Inject javascript
      const navigationJs = props.onShouldStartLoadWithRequest
        ? NAVIGATION_INTERCEPTION_JS
        : "";
      const jsToInject = `${DEFAULT_INJECT_JS} ${
        props.injectedJavaScript ?? ""
      } ${props.injectedJavaScriptBeforeContentLoaded ?? ""} ${navigationJs}`;
      return replaceLast(
        pageHtml,
        "</body>",
        `<script>${jsToInject}</script></body>`,
      );
    }
    return undefined;
  }, [
    source,
    props.injectedJavaScript,
    props.injectedJavaScriptBeforeContentLoaded,
    props.onShouldStartLoadWithRequest,
  ]);

  // Initialize ref - most functions here are mocked - we should implement them
  useImperativeHandle(
    ref,
    () =>
      ({
        goBack: () => {
          iframeRef.current?.contentWindow?.history.back();
        },
        goForward: () => {
          iframeRef.current?.contentWindow?.history.forward();
        },
        reload: () => {
          iframeRef.current?.contentWindow?.location.reload();
        },
        stopLoading: () => {
          iframeRef.current?.contentWindow?.stop();
        },
        injectJavaScript: (js: string) => {
          // @ts-ignore
          iframeRef.current?.contentWindow?.Function(js)();
        },
        forceUpdate: () => {},
        postMessage: (message: string, origin: string) => {
          iframeRef.current?.contentWindow?.postMessage(message, origin);
        },
        clearCache: () => {},
        requestFocus: () => {
          iframeRef.current?.contentWindow?.focus();
        },
        clearHistory: () => {},
        clearFormData: () => {},
      }) as unknown as WebView,
  );

  useEffect(() => {
    // Listen for messages
    if (!props.onMessage && !props.onShouldStartLoadWithRequest) return;
    const onMessage = (nativeEvent: MessageEvent) => {
      let data = nativeEvent.data;
      if (typeof data === "string") {
        try {
          const parsedData = JSON.parse(data);
          if (
            parsedData.type === "navigationStateChange" &&
            props.onShouldStartLoadWithRequest
          ) {
            // @ts-ignore
            const shouldStart = props.onShouldStartLoadWithRequest({
              url: parsedData.url,
              navigationType: parsedData.navigationType,
            });
            if (shouldStart && iframeRef.current) {
              iframeRef.current.src = parsedData.url;
            }
            return;
          }
        } catch (e) {
          // not a special json message, fall through
        }
      }
      if (props.onMessage) {
        // @ts-ignore
        return props.onMessage({ nativeEvent });
      }
    };
    window.addEventListener("message", onMessage, true);
    return () => {
      window.removeEventListener("message", onMessage, true);
    };
  }, [props.onMessage, props.onShouldStartLoadWithRequest]);
  // console.log("WebWebView1", props);

  return (
    <iframe
      title={title}
      ref={iframeRef}
      src={
        typeof source === "object" && "uri" in source ? source.uri : undefined
      }
      srcDoc={_source}
      width={styleObj.width?.toString()}
      height={styleObj.height?.toString()}
      style={
        StyleSheet.flatten([
          styles.iframe,
          !scrollEnabled && styles.noScroll,
          style,
        ]) as React.CSSProperties
      }
      allowFullScreen
      seamless
      onLoad={onLoad as unknown as ReactEventHandler<HTMLIFrameElement>}
    />
  );
});

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iframe: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
  },
  noScroll: {
    overflow: "hidden",
  },
});
