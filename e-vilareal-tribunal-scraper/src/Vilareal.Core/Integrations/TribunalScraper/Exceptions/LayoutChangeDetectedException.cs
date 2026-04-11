namespace Vilareal.Core.Integrations.TribunalScraper.Exceptions;

public sealed class LayoutChangeDetectedException : TribunalScraperException
{
    public string SeletorAnterior { get; }

    public string SeletorNovo { get; }

    public LayoutChangeDetectedException(string tribunal, string seletorAnterior, string seletorNovo)
        : base("Possível mudança de layout detectada.", tribunal)
    {
        SeletorAnterior = seletorAnterior;
        SeletorNovo = seletorNovo;
    }
}
