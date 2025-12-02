package com.reservas.backend.config;

import java.util.Collection;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.stereotype.Component;

import com.reservas.backend.model.User;
import com.reservas.backend.repository.UserRepository;

@Component
public class CustomJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserRepository userRepository;
    private final JwtGrantedAuthoritiesConverter defaultGrantedAuthoritiesConverter;

    public CustomJwtAuthenticationConverter(UserRepository userRepository) {
        this.userRepository = userRepository;
        this.defaultGrantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        this.defaultGrantedAuthoritiesConverter.setAuthoritiesClaimName("permissions");
        this.defaultGrantedAuthoritiesConverter.setAuthorityPrefix("SCOPE_");
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = defaultGrantedAuthoritiesConverter.convert(jwt);
        String auth0Id = jwt.getSubject();

        Optional<User> userOpt = userRepository.findByAuth0Id(auth0Id);

        if (userOpt.isPresent()) {
            String localRole = userOpt.get().getRole();

            if (localRole != null && !localRole.isEmpty()) {
                SimpleGrantedAuthority databaseRole = new SimpleGrantedAuthority("ROLE_" + localRole.toUpperCase());
                authorities = Stream.concat(authorities.stream(), Stream.of(databaseRole))
                                    .collect(Collectors.toSet());
            }
        }

        return new JwtAuthenticationToken(jwt, authorities);
    }
}