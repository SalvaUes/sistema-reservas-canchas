package com.reservas.backend.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.reservas.backend.model.User;
import com.reservas.backend.repository.UserRepository;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public User saveUser(User user) {
        return userRepository.save(user);
    }
}
