namespace Vilareal.Core.Integrations.TribunalScraper.Exceptions;

public sealed class LawyerNotFoundException : TribunalScraperException
{
    public string LawyerName { get; }

    public string OabNumber { get; }

    public LawyerNotFoundException(string tribunal, string lawyerName, string oabNumber)
        : base("Nenhum processo encontrado para o advogado informado.", tribunal)
    {
        LawyerName = lawyerName;
        OabNumber = oabNumber;
    }
}
