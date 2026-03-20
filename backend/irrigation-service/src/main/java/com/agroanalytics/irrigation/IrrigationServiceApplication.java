package com.agroanalytics.irrigation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class IrrigationServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(IrrigationServiceApplication.class, args);
    }
}
