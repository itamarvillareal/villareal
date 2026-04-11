using Vilareal.Core.Integrations.TribunalScraper.Models;

namespace Vilareal.Core.Integrations.TribunalScraper.Abstractions;

/// <summary>Orquestra buscas por advogado e operações auxiliares (linha isolada; persistência opcional).</summary>
public interface ITribunalScraperService
{
    Task<IReadOnlyList<ProcessoScrapedDto>> SearchByLawyerAsync(LawyerSearchRequest request, CancellationToken cancellationToken = default);

    Task<ProcessoScrapedDto?> GetProcessDetailsAsync(string numeroProcesso, string tribunalCode, CancellationToken cancellationToken = default);

    /// <summary>Reservado: nesta linha isolada não persiste em banco — retorno descreve intenção.</summary>
    Task<SyncResult> SyncProcessAsync(string numeroProcesso, string tribunalCode, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PublicacaoScrapedDto>> GetPublicationsAsync(
        string numeroProcesso,
        string tribunalCode,
        DateTime? since,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SyncHistoryRecord>> GetSyncHistoryAsync(int limit, SyncFilter? filters, CancellationToken cancellationToken = default);
}
