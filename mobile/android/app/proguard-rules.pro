# Add project specific ProGuard rules here.
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes *Annotation*

# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class * extends com.getcapacitor.BridgeActivity { *; }
-keep class * implements com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin <fields>;
    @com.getcapacitor.annotation.CapacitorPlugin <methods>;
}

# Keep FCM
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.firebase.messaging.** { *; }

# Keep AndroidX
-keep class androidx.** { *; }
-keep class androidx.core.splashscreen.** { *; }

# Keep WebView related
-keepclassmembers class android.webkit.WebView {
   public *;
}
-keepclassmembers class * extends android.webkit.WebViewClient {
   public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
   public boolean *(android.webkit.WebView, java.lang.String);
   public void *(android.webkit.WebView, java.lang.String);
}