package com.reservas.backend.security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.reservas.backend.model.User;
import com.reservas.backend.repository.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class UserStatusFilter extends OncePerRequestFilter {

    @Autowired
    private UserRepository userRepository;

    // 1. Ocultamos el string hardcodeado inyectándolo desde properties
    @Value("${auth0.claims.roles}")
    private String rolesClaim;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        // Verificamos si es una autenticación JWT válida
        if (isValidJwtAuthentication(authentication)) {
            Jwt jwt = (Jwt) authentication.getPrincipal();
            String auth0Id = jwt.getSubject();

            Optional<User> userOpt = userRepository.findByAuth0Id(auth0Id);

            if (userOpt.isPresent()) {
                User user = userOpt.get();
                
                // 2. La lógica principal ahora es limpia y fácil de leer
                if (isUserInactive(user)) {
                    sendErrorResponse(response, "Su cuenta ha sido desactivada. Sesión terminada.");
                    return; // 🚫 Stop
                }

                if (hasRoleChanged(user, jwt)) {
                    sendErrorResponse(response, "Su rol ha cambiado. Por favor inicie sesión nuevamente.");
                    return; // 🚫 Stop
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    // ==========================================
    // MÉTODOS PRIVADOS (Lógica oculta aquí)
    // ==========================================

    private boolean isValidJwtAuthentication(Authentication auth) {
        return auth != null && auth.getPrincipal() instanceof Jwt;
    }

    private boolean isUserInactive(User user) {
        return "INACTIVE".equalsIgnoreCase(user.getStatus());
    }

    private boolean hasRoleChanged(User user, Jwt jwt) {
        // Obtenemos roles del token usando la variable inyectada
        List<String> tokenRoles = jwt.getClaimAsStringList(rolesClaim);
        String dbRole = user.getRole(); 

        // Si el token tiene roles, pero el rol de BD no está en esa lista -> Hubo cambio
        return tokenRoles != null && dbRole != null && !tokenRoles.contains(dbRole);
    }

    private void sendErrorResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"message\": \"" + message + "\"}");
    }
}