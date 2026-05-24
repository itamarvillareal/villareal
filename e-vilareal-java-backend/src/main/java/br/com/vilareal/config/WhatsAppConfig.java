package br.com.vilareal.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Propriedades da integração WhatsApp Business Cloud API (Meta Graph API).
 */
@Configuration
@ConfigurationProperties(prefix = "whatsapp")
public class WhatsAppConfig {

    private String apiUrl = "https://graph.facebook.com/v21.0";
    private String phoneNumberId = "123456789";
    private String accessToken = "token-placeholder";
    private String verifyToken = "villareal-verify-token-dev";
    private String wabaId = "000000000";
    private String appSecret = "secret-placeholder";
    private boolean validateSignature = false;

    public String getApiUrl() {
        return apiUrl;
    }

    public void setApiUrl(String apiUrl) {
        this.apiUrl = apiUrl;
    }

    public String getPhoneNumberId() {
        return phoneNumberId;
    }

    public void setPhoneNumberId(String phoneNumberId) {
        this.phoneNumberId = phoneNumberId;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getVerifyToken() {
        return verifyToken;
    }

    public void setVerifyToken(String verifyToken) {
        this.verifyToken = verifyToken;
    }

    public String getWabaId() {
        return wabaId;
    }

    public void setWabaId(String wabaId) {
        this.wabaId = wabaId;
    }

    public String getAppSecret() {
        return appSecret;
    }

    public void setAppSecret(String appSecret) {
        this.appSecret = appSecret;
    }

    public boolean isValidateSignature() {
        return validateSignature;
    }

    public void setValidateSignature(boolean validateSignature) {
        this.validateSignature = validateSignature;
    }
}
