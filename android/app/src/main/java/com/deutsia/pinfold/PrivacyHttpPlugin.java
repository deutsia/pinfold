package com.deutsia.pinfold;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.deutsia.pinfold.BuildConfig;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.UnknownHostException;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.Dns;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Native HTTP plugin that routes .b32.i2p addresses through the local I2P HTTP proxy
 * (localhost:4444) and .onion addresses through Tor SOCKS5 (localhost:9050).
 *
 * CapacitorHttp uses Android's system DNS resolver which cannot resolve .b32.i2p or
 * .onion addresses. This plugin bypasses system DNS by routing requests through the
 * appropriate local proxy using OkHttp's Proxy support.
 *
 * Matches the approach used in deutsia-radio (RadioService.kt).
 */
@CapacitorPlugin(name = "PrivacyHttp")
public class PrivacyHttpPlugin extends Plugin {

    private static final String TAG = "PrivacyHttp";

    // I2P tunnels are inherently slow; allow up to 60 seconds for connect/read.
    // Tor is faster in practice; 30 seconds is sufficient.
    private static final int I2P_TIMEOUT_S = 60;
    private static final int TOR_TIMEOUT_S = 30;

    private static final String I2P_PROXY_HOST = "127.0.0.1";
    private static final int I2P_PROXY_PORT = 4444;

    private static final String TOR_PROXY_HOST = "127.0.0.1";
    private static final int TOR_PROXY_PORT = 9050;

    /**
     * Placeholder DNS resolver for SOCKS5 Tor routing.
     * Returns a dummy 0.0.0.0 address so OkHttp doesn't call system DNS —
     * the SOCKS5 proxy handles hostname resolution internally.
     */
    private static final Dns TOR_DNS = new Dns() {
        @Override
        public List<InetAddress> lookup(String hostname) throws UnknownHostException {
            try {
                return Collections.singletonList(
                    InetAddress.getByAddress(hostname, new byte[]{0, 0, 0, 0})
                );
            } catch (Exception e) {
                throw new UnknownHostException(e.getMessage());
            }
        }
    };

    private static boolean isI2P(String url) {
        return url.contains(".b32.i2p");
    }

    private static boolean isTor(String url) {
        return url.contains(".onion");
    }

    private OkHttpClient buildClient(String url, boolean followRedirects) {
        int timeoutS = isI2P(url) ? I2P_TIMEOUT_S : TOR_TIMEOUT_S;
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
            .connectTimeout(timeoutS, TimeUnit.SECONDS)
            .readTimeout(timeoutS, TimeUnit.SECONDS)
            .followRedirects(followRedirects)
            .followSslRedirects(followRedirects);

        if (isI2P(url)) {
            // Route through local I2P HTTP proxy (InviZible Pro / I2Pd default: 127.0.0.1:4444)
            builder.proxy(new Proxy(
                Proxy.Type.HTTP,
                new InetSocketAddress(I2P_PROXY_HOST, I2P_PROXY_PORT)
            ));
        } else if (isTor(url)) {
            // Route through Tor SOCKS5 (Orbot / InviZible Pro default: 127.0.0.1:9050)
            // Use placeholder DNS to prevent DNS leaks through system resolver.
            builder.proxy(new Proxy(
                Proxy.Type.SOCKS,
                new InetSocketAddress(TOR_PROXY_HOST, TOR_PROXY_PORT)
            ));
            builder.dns(TOR_DNS);
        }

        return builder.build();
    }

    /** Try to parse body as JSON object or array; fall back to raw string. */
    private static Object parseBody(String body) {
        if (body == null || body.isEmpty()) return "";
        try {
            if (body.charAt(0) == '{') return new JSONObject(body);
            if (body.charAt(0) == '[') return new JSONArray(body);
        } catch (JSONException ignored) {}
        return body;
    }

    @PluginMethod
    public void request(final PluginCall call) {
        final String url = call.getString("url");
        final String method = call.getString("method", "GET").toUpperCase();
        final JSObject headers = call.getObject("headers");
        final String data = call.getString("data");
        final String responseType = call.getString("responseType", "text");

        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }

        String proxyType = isI2P(url) ? "I2P" : isTor(url) ? "Tor" : "direct";
        if (BuildConfig.DEBUG) Log.d(TAG, method + " via " + proxyType);

        // Network calls must run off the main thread.
        new Thread(() -> {
            try {
                Request.Builder rb = new Request.Builder().url(url);

                if (headers != null) {
                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        String value = headers.getString(key);
                        if (value != null) rb.header(key, value);
                    }
                }

                RequestBody requestBody = null;
                if ("POST".equals(method) && data != null) {
                    requestBody = RequestBody.create(
                        data,
                        MediaType.parse("application/x-www-form-urlencoded")
                    );
                }
                rb.method(method, requestBody);

                // Disable redirects for blob requests to prevent the proxy from
                // redirecting to a clearnet URL that OkHttp can't reach without the proxy.
                boolean followRedirects = !"blob".equals(responseType);
                OkHttpClient client = buildClient(url, followRedirects);
                long startMs = System.currentTimeMillis();
                try (Response response = client.newCall(rb.build()).execute()) {
                    long elapsedMs = System.currentTimeMillis() - startMs;
                    if (BuildConfig.DEBUG) Log.d(TAG, "Response " + response.code() + " in " + elapsedMs + "ms");

                    JSObject responseHeaders = new JSObject();
                    for (String name : response.headers().names()) {
                        responseHeaders.put(name, response.header(name));
                    }

                    JSObject result = new JSObject();
                    result.put("status", response.code());
                    result.put("headers", responseHeaders);

                    if ("blob".equals(responseType)) {
                        // Return binary data as base64 (for image loading).
                        byte[] bytes = response.body() != null
                            ? response.body().bytes()
                            : new byte[0];
                        if (BuildConfig.DEBUG) {
                            Log.d(TAG, "Blob response: " + bytes.length + " bytes");
                            if (bytes.length == 0) {
                                Log.w(TAG, "Empty blob body");
                            }
                        }
                        result.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
                    } else {
                        String responseBody = response.body() != null
                            ? response.body().string()
                            : "";
                        Object parsedData = parseBody(responseBody);
                        if (parsedData instanceof JSONObject) {
                            result.put("data", (JSONObject) parsedData);
                        } else if (parsedData instanceof JSONArray) {
                            result.put("data", (JSONArray) parsedData);
                        } else {
                            result.put("data", parsedData.toString());
                        }
                    }

                    call.resolve(result);
                }
            } catch (IOException e) {
                if (BuildConfig.DEBUG) Log.e(TAG, "Network error: " + e.getMessage());
                call.reject(e.getMessage(), "NETWORK_ERROR", e);
            } catch (Exception e) {
                if (BuildConfig.DEBUG) Log.e(TAG, "Unexpected error: " + e.getMessage());
                call.reject(e.getMessage(), "UNKNOWN_ERROR", e);
            }
        }).start();
    }

    /**
     * Save a base64-encoded file directly to the device's Downloads folder.
     * Uses MediaStore on API 29+ for scoped storage compatibility,
     * and direct file write on older versions.
     */
    @PluginMethod
    public void saveToDownloads(final PluginCall call) {
        final String base64Data = call.getString("data");
        final String fileName = call.getString("fileName");
        final String mimeType = call.getString("mimeType", "image/jpeg");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("data is required");
            return;
        }
        if (fileName == null || fileName.isEmpty()) {
            call.reject("fileName is required");
            return;
        }

        // Sanitize filename to prevent path traversal
        final String safeFileName = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");

        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // API 29+ — use MediaStore to write to Downloads
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeFileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = getContext().getContentResolver().insert(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
                    );
                    if (uri == null) {
                        call.reject("Failed to create file in Downloads");
                        return;
                    }

                    try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
                        if (os == null) {
                            call.reject("Failed to open output stream");
                            return;
                        }
                        os.write(bytes);
                        os.flush();
                    }

                    if (BuildConfig.DEBUG) Log.d(TAG, "Saved " + safeFileName + " to Downloads via MediaStore (" + bytes.length + " bytes)");
                } else {
                    // API < 29 — write directly to public Downloads folder
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS
                    );
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File file = new File(downloadsDir, safeFileName);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(bytes);
                        fos.flush();
                    }

                    if (BuildConfig.DEBUG) Log.d(TAG, "Saved " + safeFileName + " (" + bytes.length + " bytes)");
                }

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("fileName", safeFileName);
                call.resolve(result);
            } catch (Exception e) {
                if (BuildConfig.DEBUG) Log.e(TAG, "Failed to save to Downloads: " + e.getMessage());
                call.reject("Failed to save: " + e.getMessage(), "SAVE_ERROR", e);
            }
        }).start();
    }
}
