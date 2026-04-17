package com.deutsia.pinfold;

import android.graphics.Color;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that keeps both the status bar and navigation bar
 * in sync with the app's dark / light theme.
 *
 * Stores the last requested style and re-applies it on every Activity
 * resume, because Android can reset bar appearance during pause/resume
 * or configuration-change cycles.
 */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {

    private Boolean lastIsDark = null;
    private Integer lastStatusColor = null;
    private Integer lastNavColor = null;

    @PluginMethod
    public void setStyle(final PluginCall call) {
        boolean isDark = Boolean.TRUE.equals(call.getBoolean("isDark", true));
        String statusColorStr = call.getString("statusBarColor");
        String navColorStr = call.getString("navigationBarColor");

        int defaultColor = Color.parseColor(isDark ? "#000000" : "#f5f5f5");
        int statusColor = parseColorOrDefault(statusColorStr, defaultColor);
        int navColor = parseColorOrDefault(navColorStr, defaultColor);

        lastIsDark = isDark;
        lastStatusColor = statusColor;
        lastNavColor = navColor;
        applyStyle(isDark, statusColor, navColor);
        call.resolve();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (lastIsDark != null && lastStatusColor != null && lastNavColor != null) {
            applyStyle(lastIsDark, lastStatusColor, lastNavColor);
        }
    }

    private static int parseColorOrDefault(String raw, int fallback) {
        if (raw == null || raw.isEmpty()) return fallback;
        try {
            return Color.parseColor(raw);
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }

    private void applyStyle(boolean isDark, int statusColor, int navColor) {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());

            // true = dark icons/handle (for light backgrounds)
            // false = light icons/handle (for dark backgrounds)
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark);

            window.setStatusBarColor(statusColor);
            window.setNavigationBarColor(navColor);
        });
    }
}
