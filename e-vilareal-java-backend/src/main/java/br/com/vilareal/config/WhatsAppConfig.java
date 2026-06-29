package br.com.vilareal.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Propriedades da integração WhatsApp Business Cloud API (Meta Graph API).
 */
@Configuration
@ConfigurationProperties(prefix = "whatsapp")
public class WhatsAppConfig {

    private String apiUrl = "https://graph.facebook.com/v25.0";
    private String phoneNumberId = "123456789";
    private String accessToken = "token-placeholder";
    private String verifyToken = "villareal-verify-token-dev";
    private String wabaId = "000000000";
    private String appSecret = "secret-placeholder";
    private boolean validateSignature = false;

    private boolean reminderEnabled = true;
    private int reminderDaysAhead = 3;
    private String reminderCron = "0 0 7 * * MON-FRI";
    private boolean reminderReforcoEnabled = true;
    private String reminderReforcoCron = "0 0 18 * * MON-FRI";

    private CopiaMonitoramento copiaMonitoramento = new CopiaMonitoramento();

    private boolean aniversarioEnabled = true;
    private String aniversarioCron = "0 0 8 * * *";

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

    public boolean isReminderEnabled() {
        return reminderEnabled;
    }

    public void setReminderEnabled(boolean reminderEnabled) {
        this.reminderEnabled = reminderEnabled;
    }

    public int getReminderDaysAhead() {
        return reminderDaysAhead;
    }

    public void setReminderDaysAhead(int reminderDaysAhead) {
        this.reminderDaysAhead = reminderDaysAhead;
    }

    public String getReminderCron() {
        return reminderCron;
    }

    public void setReminderCron(String reminderCron) {
        this.reminderCron = reminderCron;
    }

    public boolean isReminderReforcoEnabled() {
        return reminderReforcoEnabled;
    }

    public void setReminderReforcoEnabled(boolean reminderReforcoEnabled) {
        this.reminderReforcoEnabled = reminderReforcoEnabled;
    }

    public String getReminderReforcoCron() {
        return reminderReforcoCron;
    }

    public void setReminderReforcoCron(String reminderReforcoCron) {
        this.reminderReforcoCron = reminderReforcoCron;
    }

    public CopiaMonitoramento getCopiaMonitoramento() {
        return copiaMonitoramento;
    }

    public void setCopiaMonitoramento(CopiaMonitoramento copiaMonitoramento) {
        this.copiaMonitoramento = copiaMonitoramento != null ? copiaMonitoramento : new CopiaMonitoramento();
    }

    public boolean isAniversarioEnabled() {
        return aniversarioEnabled;
    }

    public void setAniversarioEnabled(boolean aniversarioEnabled) {
        this.aniversarioEnabled = aniversarioEnabled;
    }

    public String getAniversarioCron() {
        return aniversarioCron;
    }

    public void setAniversarioCron(String aniversarioCron) {
        this.aniversarioCron = aniversarioCron;
    }

    /** Cópia best-effort de cada envio outbound para número de monitoramento. */
    public static class CopiaMonitoramento {
        private String numero = "+5562982345000";
        private boolean ativo = true;

        public String getNumero() {
            return numero;
        }

        public void setNumero(String numero) {
            this.numero = numero;
        }

        public boolean isAtivo() {
            return ativo;
        }

        public void setAtivo(boolean ativo) {
            this.ativo = ativo;
        }
    }
}
