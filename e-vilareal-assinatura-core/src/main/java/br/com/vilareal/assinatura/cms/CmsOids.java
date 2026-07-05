package br.com.vilareal.assinatura.cms;

import java.util.Set;

final class CmsOids {

    static final String SIGNED_DATA = "1.2.840.113549.1.7.2";
    static final String ID_DATA = "1.2.840.113549.1.7.1";
    static final String SHA512 = "2.16.840.1.101.3.4.2.3";
    static final String RSA_ENCRYPTION = "1.2.840.113549.1.1.1";
    static final String SHA512_WITH_RSA = "1.2.840.113549.1.1.13";

    static final String ATTR_CONTENT_TYPE = "1.2.840.113549.1.9.3";
    static final String ATTR_SIGNING_TIME = "1.2.840.113549.1.9.5";
    static final String ATTR_MESSAGE_DIGEST = "1.2.840.113549.1.9.4";
    static final String ATTR_SIGNING_CERTIFICATE = "1.2.840.113549.1.9.16.2.15";
    static final String ATTR_SIGNING_CERTIFICATE_V2 = "1.2.840.113549.1.9.16.2.47";
    static final String ATTR_TIMESTAMP = "1.2.840.113549.1.9.16.2.14";

    static final Set<String> SIGNED_ATTRS_ESPERADOS =
            Set.of(ATTR_CONTENT_TYPE, ATTR_SIGNING_TIME, ATTR_MESSAGE_DIGEST);

    static final String ATTR_CMS_ALGORITHM_PROTECTION = "1.2.840.113549.1.9.52";

    static final Set<String> SIGNED_ATTRS_PROIBIDOS = Set.of(
            ATTR_SIGNING_CERTIFICATE,
            ATTR_SIGNING_CERTIFICATE_V2,
            ATTR_TIMESTAMP,
            ATTR_CMS_ALGORITHM_PROTECTION);

    private CmsOids() {}
}
