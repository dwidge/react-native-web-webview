import { Platform } from "react-native";
import { WebWebView, type WebWebviewProps } from "./WebView";
import { WebView as DefaultWebView } from "react-native-webview";
import { forwardRef } from "react";

export const WebView = forwardRef<DefaultWebView, WebWebviewProps>(
  (props, ref) =>
    Platform.OS === "web" ? (
      <WebWebView ref={ref} {...props} />
    ) : (
      <DefaultWebView ref={ref} {...props} />
    )
);
export type WebView = DefaultWebView;
