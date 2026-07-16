package com.gmpredes.helpdesk;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Sobrescribir el User-Agent del WebView para que Cloudflare no lo bloquee
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            String ua = webView.getSettings().getUserAgentString();
            // Asegurar que el UA incluya Chrome y no exponga Capacitor/WebView
            if (ua != null && !ua.contains("Chrome/")) {
                webView.getSettings().setUserAgentString(
                    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                );
            }
            // Forzar allowed mixed content y DOM storage
            webView.getSettings().setDomStorageEnabled(true);
            webView.getSettings().setAllowFileAccess(true);
            webView.getSettings().setMixedContentMode(0);
        }
    }
}