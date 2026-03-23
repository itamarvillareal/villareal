package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.MonitoringSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MonitoringSettingsRepository extends JpaRepository<MonitoringSettings, Long> {
}
