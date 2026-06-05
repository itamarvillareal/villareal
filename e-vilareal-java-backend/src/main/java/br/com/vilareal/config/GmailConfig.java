package br.com.vilareal.config;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.store.FileDataStoreFactory;
import br.com.vilareal.email.GmailApiProvider;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.util.StringUtils;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.GeneralSecurityException;
import java.util.List;

/**
 * Registra o singleton {@code gmail} em {@link #registrarGmailSePossivel()} após o contexto subir.
 * OTP e demais leituras pontuais devem usar {@link br.com.vilareal.email.GmailApiProvider} no momento
 * do uso — injeção direta de {@link Gmail} no construtor fica {@code null} (bean ainda não existe).
 */
@Configuration
public class GmailConfig implements ApplicationContextAware {

    private static final Logger log = LoggerFactory.getLogger(GmailConfig.class);
    private static final List<String> SCOPES = List.of(GmailScopes.GMAIL_MODIFY);

    private ApplicationContext applicationContext;

    @Value("${gmail.credentials.path}")
    private String credentialsPath;

    @Value("${gmail.tokens.directory}")
    private String tokensDirectory;

    @Value("${gmail.user}")
    private String gmailUser;

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        this.applicationContext = applicationContext;
    }

    @PostConstruct
    public void registrarGmailSePossivel() {
        if (!StringUtils.hasText(credentialsPath)) {
            log.warn("Gmail API não configurada: gmail.credentials.path ausente");
            return;
        }
        if (!StringUtils.hasText(tokensDirectory)) {
            log.warn("Gmail API não configurada: gmail.tokens.directory ausente");
            return;
        }
        if (!StringUtils.hasText(gmailUser)) {
            log.warn("Gmail API não configurada: gmail.user ausente");
            return;
        }

        try {
            Gmail gmail = criarGmail(credentialsPath, tokensDirectory, gmailUser);
            ConfigurableListableBeanFactory beanFactory =
                    ((ConfigurableApplicationContext) applicationContext).getBeanFactory();
            beanFactory.registerSingleton(GmailApiProvider.BEAN_NAME, gmail);
            log.info("Gmail API configurada (usuário={}, tokens={})", gmailUser, tokensDirectory);
        } catch (Exception e) {
            log.warn("Gmail API não configurada: {}", e.getMessage());
        }
    }

    private static Gmail criarGmail(String credentialsPath, String tokensDirectory, String gmailUser)
            throws GeneralSecurityException, IOException {
        try (InputStream credentialsStream = abrirCredentials(credentialsPath)) {
            NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
            GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(
                    GsonFactory.getDefaultInstance(),
                    new InputStreamReader(credentialsStream, StandardCharsets.UTF_8));

            File tokensDir = new File(tokensDirectory);
            Files.createDirectories(tokensDir.toPath());

            GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                            transport,
                            GsonFactory.getDefaultInstance(),
                            clientSecrets,
                            SCOPES)
                    .setDataStoreFactory(new FileDataStoreFactory(tokensDir))
                    .setAccessType("offline")
                    .build();

            Credential credential = flow.loadCredential(gmailUser);
            if (credential == null) {
                throw new IOException(
                        "Tokens OAuth ausentes em "
                                + tokensDir.getAbsolutePath()
                                + " — autorize a conta Gmail offline antes de usar a API");
            }
            if (credential.getExpiresInSeconds() != null && credential.getExpiresInSeconds() <= 60L) {
                credential.refreshToken();
            }

            return new Gmail.Builder(transport, GsonFactory.getDefaultInstance(), credential)
                    .setApplicationName("VilaReal API")
                    .build();
        }
    }

    private static InputStream abrirCredentials(String credentialsPath) throws IOException {
        if (credentialsPath.startsWith("classpath:")) {
            String classpathLocation = credentialsPath.substring("classpath:".length());
            Resource resource = new ClassPathResource(classpathLocation);
            if (!resource.exists()) {
                throw new IOException("Arquivo de credenciais não encontrado: " + credentialsPath);
            }
            return resource.getInputStream();
        }
        File file = new File(credentialsPath);
        if (!file.isFile()) {
            throw new IOException("Arquivo de credenciais não encontrado: " + credentialsPath);
        }
        return Files.newInputStream(file.toPath());
    }
}
