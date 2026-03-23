package br.com.vilareal.api.entity;

import br.com.vilareal.api.monitoring.domain.HitReviewStatus;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "monitoring_hits", indexes = {
        @Index(name = "idx_mhit_person_review", columnList = "monitored_person_id,review_status"),
        @Index(name = "idx_mhit_dedup", columnList = "dedup_hash")
})
public class MonitoringHit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "monitored_person_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_mhit_person"))
    private MonitoredPerson monitoredPerson;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "monitoring_run_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_mhit_run"))
    private MonitoringRun monitoringRun;

    @Column(nullable = false, length = 64)
    private String tribunal;

    @Column(name = "process_number", nullable = false, length = 64)
    private String processNumber;

    @Column(name = "process_number_normalized", nullable = false, length = 64)
    private String processNumberNormalized;

    @Column(name = "hit_type", nullable = false, length = 64)
    private String hitType;

    @Column(name = "source_strategy", nullable = false, length = 64)
    private String sourceStrategy;

    @Column(name = "class_name", length = 255)
    private String className;

    @Column(name = "subject_names", columnDefinition = "LONGTEXT")
    private String subjectNames;

    @Column(name = "court_unit_name", length = 512)
    private String courtUnitName;

    @Column(name = "filing_date", length = 64)
    private String filingDate;

    @Column(name = "secrecy_level", length = 64)
    private String secrecyLevel;

    @Column(name = "last_movement_name", columnDefinition = "LONGTEXT")
    private String lastMovementName;

    @Column(name = "last_movement_at", length = 64)
    private String lastMovementAt;

    @Column(name = "match_score", nullable = false, length = 16)
    private String matchScore;

    @Column(name = "match_reason", nullable = false, length = 512)
    private String matchReason;

    @Column(name = "raw_payload_json", columnDefinition = "LONGTEXT")
    private String rawPayloadJson;

    @Column(name = "dedup_hash", nullable = false, length = 128)
    private String dedupHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", nullable = false, length = 32)
    private HitReviewStatus reviewStatus = HitReviewStatus.PENDING;

    @Column(name = "suggested_link_note", length = 512)
    private String suggestedLinkNote;

    @Column(name = "linked_process_id")
    private Long linkedProcessId;

    @Column(name = "linked_client_id")
    private Long linkedClientId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public MonitoredPerson getMonitoredPerson() { return monitoredPerson; }
    public void setMonitoredPerson(MonitoredPerson monitoredPerson) { this.monitoredPerson = monitoredPerson; }
    public MonitoringRun getMonitoringRun() { return monitoringRun; }
    public void setMonitoringRun(MonitoringRun monitoringRun) { this.monitoringRun = monitoringRun; }
    public String getTribunal() { return tribunal; }
    public void setTribunal(String tribunal) { this.tribunal = tribunal; }
    public String getProcessNumber() { return processNumber; }
    public void setProcessNumber(String processNumber) { this.processNumber = processNumber; }
    public String getProcessNumberNormalized() { return processNumberNormalized; }
    public void setProcessNumberNormalized(String processNumberNormalized) { this.processNumberNormalized = processNumberNormalized; }
    public String getHitType() { return hitType; }
    public void setHitType(String hitType) { this.hitType = hitType; }
    public String getSourceStrategy() { return sourceStrategy; }
    public void setSourceStrategy(String sourceStrategy) { this.sourceStrategy = sourceStrategy; }
    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }
    public String getSubjectNames() { return subjectNames; }
    public void setSubjectNames(String subjectNames) { this.subjectNames = subjectNames; }
    public String getCourtUnitName() { return courtUnitName; }
    public void setCourtUnitName(String courtUnitName) { this.courtUnitName = courtUnitName; }
    public String getFilingDate() { return filingDate; }
    public void setFilingDate(String filingDate) { this.filingDate = filingDate; }
    public String getSecrecyLevel() { return secrecyLevel; }
    public void setSecrecyLevel(String secrecyLevel) { this.secrecyLevel = secrecyLevel; }
    public String getLastMovementName() { return lastMovementName; }
    public void setLastMovementName(String lastMovementName) { this.lastMovementName = lastMovementName; }
    public String getLastMovementAt() { return lastMovementAt; }
    public void setLastMovementAt(String lastMovementAt) { this.lastMovementAt = lastMovementAt; }
    public String getMatchScore() { return matchScore; }
    public void setMatchScore(String matchScore) { this.matchScore = matchScore; }
    public String getMatchReason() { return matchReason; }
    public void setMatchReason(String matchReason) { this.matchReason = matchReason; }
    public String getRawPayloadJson() { return rawPayloadJson; }
    public void setRawPayloadJson(String rawPayloadJson) { this.rawPayloadJson = rawPayloadJson; }
    public String getDedupHash() { return dedupHash; }
    public void setDedupHash(String dedupHash) { this.dedupHash = dedupHash; }
    public HitReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(HitReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }
    public String getSuggestedLinkNote() { return suggestedLinkNote; }
    public void setSuggestedLinkNote(String suggestedLinkNote) { this.suggestedLinkNote = suggestedLinkNote; }
    public Long getLinkedProcessId() { return linkedProcessId; }
    public void setLinkedProcessId(Long linkedProcessId) { this.linkedProcessId = linkedProcessId; }
    public Long getLinkedClientId() { return linkedClientId; }
    public void setLinkedClientId(Long linkedClientId) { this.linkedClientId = linkedClientId; }
}
