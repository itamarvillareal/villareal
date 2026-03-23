package br.com.vilareal.api.monitoring.exception;

public class MonitoringNotFoundException extends RuntimeException {
    public MonitoringNotFoundException(String message) {
        super(message);
    }
}
