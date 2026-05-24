package br.com.vilareal.email;

import com.google.api.client.extensions.java6.auth.oauth2.AuthorizationCodeInstalledApp;
import com.google.api.client.extensions.jetty.auth.oauth2.LocalServerReceiver;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.store.FileDataStoreFactory;
import com.google.api.services.gmail.GmailScopes;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.GeneralSecurityException;
import java.util.List;

/**
 * Utilitário de uso único (fora do Spring Boot) para gerar tokens OAuth2 do Gmail.
 * Execute o {@code main}, autorize no browser e reinicie a API — o {@code GmailConfig} carregará os tokens.
 */
public final class GmailAuthorizationUtil {

    private static final String CREDENTIALS_RESOURCE = "credentials.json";
    private static final String TOKENS_DIRECTORY = "/Users/itamar/gmail-tokens";
    private static final String GMAIL_USER = "me";
    private static final List<String> SCOPES = List.of(GmailScopes.GMAIL_MODIFY);

    private GmailAuthorizationUtil() {}

    public static void main(String[] args) throws GeneralSecurityException, IOException {
        InputStream credentialsStream = GmailAuthorizationUtil.class.getClassLoader().getResourceAsStream(CREDENTIALS_RESOURCE);
        if (credentialsStream == null) {
            throw new IOException(
                    "Arquivo de credenciais não encontrado no classpath: " + CREDENTIALS_RESOURCE);
        }

        try (InputStream in = credentialsStream) {
            NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
            GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(
                    GsonFactory.getDefaultInstance(), new InputStreamReader(in, StandardCharsets.UTF_8));

            File tokensDir = new File(TOKENS_DIRECTORY);
            Files.createDirectories(tokensDir.toPath());

            GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                            transport,
                            GsonFactory.getDefaultInstance(),
                            clientSecrets,
                            SCOPES)
                    .setDataStoreFactory(new FileDataStoreFactory(tokensDir))
                    .setAccessType("offline")
                    .build();

            LocalServerReceiver receiver = new LocalServerReceiver.Builder().setPort(8888).build();
            new AuthorizationCodeInstalledApp(flow, receiver).authorize(GMAIL_USER);
        }

        System.out.println("Tokens salvos com sucesso em /Users/itamar/gmail-tokens/");
    }
}
