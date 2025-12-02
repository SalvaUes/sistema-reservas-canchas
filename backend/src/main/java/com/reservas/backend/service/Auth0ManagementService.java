package com.reservas.backend.service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
public class Auth0ManagementService {

    @Value("${auth0.domain}")
    private String domain;

    @Value("${auth0.management.client-id}")
    private String clientId;

    @Value("${auth0.management.client-secret}")
    private String clientSecret;

    @Value("${auth0.roles.admin-id}")
    private String adminRoleId;

    @Value("${auth0.roles.client-id}")
    private String clientRoleId;

    private final RestTemplate restTemplate = new RestTemplate();

    // 1. Obtener Token
    private String getManagementToken() {
        String url = "https://" + domain + "/oauth/token";
        
        Map<String, String> body = new HashMap<>();
        body.put("client_id", clientId);
        body.put("client_secret", clientSecret);
        body.put("audience", "https://" + domain + "/api/v2/");
        body.put("grant_type", "client_credentials");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);
        
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            Map<String, Object> responseBody = response.getBody();
            if (responseBody != null) {
                return (String) responseBody.get("access_token");
            }
            return null;
        } catch (RestClientException e) {
            System.err.println("⚠️ Error obteniendo token de gestión Auth0: " + e.getMessage());
            return null;
        }
    }

    // 2. Actualizar Rol
    public void updateUserRole(String auth0UserId, String newRoleName) {
        String token = getManagementToken();
        if (token == null) return;

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        // ==========================================
        // PASO 1: LIMPIEZA TOTAL (Wipe)
        // ==========================================
        // Intentamos quitar AMBOS roles al mismo tiempo. 
        // Así nos aseguramos de que el usuario quede "limpio" antes de asignar nada.
        
        // NOTA: Usamos el endpoint /api/v2/users/{id}/roles para gestionar desde el usuario
        String urlUserRoles = "https://" + domain + "/api/v2/users/" + auth0UserId + "/roles";

        Map<String, Object> bodyRemove = Map.of("roles", List.of(adminRoleId, clientRoleId));
        HttpEntity<Map<String, Object>> requestRemove = new HttpEntity<>(bodyRemove, headers);

        try {
            // DELETE enviando la lista de roles a quitar
            restTemplate.exchange(urlUserRoles, HttpMethod.DELETE, requestRemove, Void.class);
            System.out.println("✅ Auth0: Se limpiaron los roles (Admin y Cliente) del usuario " + auth0UserId);
        } catch (RestClientException e) {
            // Puede fallar si el usuario no tenía roles asignados previamente, no es grave.
            System.out.println("⚠️ Aviso limpiando roles (puede ser normal si el usuario era nuevo): " + e.getMessage());
        }

        // ==========================================
        // PASO 2: ASIGNAR EL ROL NUEVO
        // ==========================================
        String roleIdToAdd = "ADMIN".equalsIgnoreCase(newRoleName) ? adminRoleId : clientRoleId;
        
        Map<String, Object> bodyAdd = Map.of("roles", List.of(roleIdToAdd));
        HttpEntity<Map<String, Object>> requestAdd = new HttpEntity<>(bodyAdd, headers);

        try {
            restTemplate.postForEntity(urlUserRoles, requestAdd, Void.class);
            System.out.println("✅ Auth0: Nuevo rol asignado correctamente: " + newRoleName);
        } catch (RestClientException e) {
            System.err.println("❌ Error asignando el nuevo rol: " + e.getMessage());
        }
    }

    // 3. 💡 NUEVO: Bloquear / Desbloquear Usuario
    public void updateUserStatus(String auth0UserId, String status) {
        String token = getManagementToken();
        if (token == null) return;

        boolean shouldBlock = "INACTIVE".equalsIgnoreCase(status);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        // En Auth0, bloquear es { "blocked": true }
        Map<String, Object> body = Map.of("blocked", shouldBlock);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        String url = "https://" + domain + "/api/v2/users/" + auth0UserId;

        try {
            restTemplate.exchange(url, HttpMethod.PATCH, request, Void.class);
            System.out.println("✅ Auth0: Usuario " + (shouldBlock ? "Bloqueado" : "Desbloqueado"));
        } catch (RestClientException e) {
            System.err.println("❌ Error actualizando estado en Auth0: " + e.getMessage());
        }
    }
}