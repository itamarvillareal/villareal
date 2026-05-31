package br.com.vilareal.common.exception;

/** Destinatário/assignee inválido (ex.: assistente de IA em campo de responsável). */
public class InvalidAssigneeException extends RuntimeException {

    public InvalidAssigneeException(String message) {
        super(message);
    }
}
